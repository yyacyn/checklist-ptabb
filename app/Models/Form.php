<?php

namespace App\Models;

use Database\Factories\FormFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * A template: the live, superadmin-editable catalogue of questions for one paper form.
 *
 * Reports copy from here at creation time and never read back (SRS FM-8).
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $form_version
 * @property int $template_version
 * @property string $answer_set
 */
#[Fillable(['code', 'name', 'form_version', 'template_version', 'answer_set'])]
class Form extends Model
{
    /** @use HasFactory<FormFactory> */
    use HasFactory;

    public function groups(): HasMany
    {
        return $this->hasMany(FormGroup::class)->orderBy('sort_order');
    }

    public function subgroups(): HasMany
    {
        return $this->hasMany(FormGroup::class)->whereNotNull('parent_id')->orderBy('sort_order');
    }

    public function questions(): HasManyThrough
    {
        return $this->hasManyThrough(FormQuestion::class, FormGroup::class, 'form_id', 'group_id');
    }

    public function evaluationCriteria(): HasMany
    {
        return $this->hasMany(EvaluationCriterion::class)->orderBy('sort_order');
    }

    /**
     * Increment the template version on structural changes (SRS FM-12, PLAN 1.3).
     *
     * Bumped only on structural changes (question added, removed, or regrouped),
     * never on wording typos.
     */
    public function bumpTemplateVersion(): int
    {
        $this->increment('template_version');

        return (int) $this->template_version;
    }
}
